import FormData      from 'form-data'
import crypto        from 'node:crypto'
import bufferReplace from 'buffer-replace'
import multiparser   from 'parse-multipart-data'

const env = {
    REPLACEMENT_ORIGIN: process.env.ORIGIN,
    SEARCH_STRING: process.env.SEARCH_STRING,
    REPLACEMENT_STRING: process.env.REPLACE_STRING
};

for (const [ key, val ] of Object.entries(env)) {
    if (!val) throw `${key} is not configured`
}

export const patchedAssets = {};

// Downloads `launchAsset` and patches it.
async function patchLaunchAsset(launchAsset, extensions) {
    let headers;

    // In some cases, the manifest may include additional headers
    // the client needs to send when requesting assets (e.g. Authorization header).
    if (extensions) {
        const ext = JSON.parse(extensions);
        if (ext.assetRequestHeaders) {
            headers = ext.assetRequestHeaders[launchAsset.key] || {};
        }
    }

    // Request the original launchAsset and perform a search-and-replace.
    const req = await fetch(launchAsset.url, { headers });
    const data = Buffer.from(new Uint8Array(await req.arrayBuffer()));
    const patched = bufferReplace(data, env.SEARCH_STRING, env.REPLACEMENT_STRING);

    // The Hermes bytecode file includes a SHA1 checksum at the end of
    // the file, which is most likely now broken by our patch. Let's fix it.
    const to_hash = patched.subarray(0, patched.length - 20);
    const digest_sha1 = crypto.createHash('SHA1').update(to_hash).digest();
    const patched_hashed = Buffer.concat([ to_hash, digest_sha1 ]);

    // The manifest also includes a hash, let's fix that one as well.
    const digest_sha256 = crypto.createHash('SHA256').update(patched_hashed).digest('base64url');
    launchAsset.hash = digest_sha256;

    // Finally, cache the patched asset, and replace the URL in the
    // original manifest.
    const uuid = crypto.randomUUID();
    patchedAssets[uuid] = patched_hashed;
    launchAsset.url = new URL(`/asset/${uuid}`, env.REPLACEMENT_ORIGIN).toString();

    return launchAsset;
}

// Takes the manifest, replaces the `launchAsset` and repackages it back
// into a multipart body.
export async function patchManifest(data, boundaryHeader) {
    try {
        var boundary = multiparser.getBoundary(boundaryHeader);
        var parsed_arr = multiparser.parse(Buffer.from(data), boundary);
    } catch {
        console.error("Something went wrong patching manifest. Returning the original.");
        return data;
    }

    const parts = Object.fromEntries(
        parsed_arr.map(({ name, data, type }) => [ name, { data, contentType: type } ])
    );

    if ('manifest' in parts) {
        const manifest = JSON.parse(parts.manifest.data);
        if ('launchAsset' in manifest) {
            manifest.launchAsset = await patchLaunchAsset(
                manifest.launchAsset,
                parts.extensions.data
            );
        }

        // Package everything back up into a multipart form.
        const formData = new FormData();
        formData.setBoundary(boundary);
        formData.append(
            'manifest',
            JSON.stringify(manifest),
            { contentType: parts.manifest.contentType }
        );

        for (const [ part, { data, contentType } ] of Object.entries(parts)) {
            if (part !== 'manifest') {
                // We don't want to modify anything except the manifest.
                // Put it back into the body as-is.
                formData.append(part, data.toString(), { contentType });
            }
        }

        return formData.getBuffer().toString();
    } else {
        return data; // We aren't familiar with this format. Return it untouched.
    }
}
