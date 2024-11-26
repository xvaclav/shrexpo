import morgan                           from 'morgan'
import express                          from 'express'
import { join }                         from 'node:path'
import { createServer }                 from 'node:https'
import { patchManifest, patchedAssets } from './patch.js'
import compression                      from 'compression'
import { readFile }                     from 'node:fs/promises'

const DOMAIN = process.env.EXPO_ORIGINAL_DOMAIN;

const app = express();

app.use(compression());
app.use(morgan('combined'));

// https://stackoverflow.com/a/13653180
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// If you want to download the root certificate onto the device
// easily, you can use this endpoint to load it via a browser.
app.get('/root.crt', (_, res) => {
    res.sendFile(join(import.meta.dirname, './certs/root.crt'));
});

app.get('/asset/:uuid', async (req, res, next) => {
    const { uuid } = req.params;
    if (!uuidRegex.test(uuid))
        return next();

    if (!patchedAssets[uuid])
        return next();

    res.set('content-type', 'application/javascript');
    res.send(patchedAssets[uuid]);
});

app.get('/:uuid', async (req, res, next) => {
    const { uuid } = req.params;
    if (!uuidRegex.test(uuid))
        return next();

    if (!req.accepts('multipart/mixed'))
        return res.sendStatus(400);

    delete req.headers['accept-encoding'];

    const realUpdate = await fetch(`https://${DOMAIN}/${uuid}`, {
        headers: { ...req.headers }
    });

    const responseHeaders = Object.fromEntries(realUpdate.headers);
    delete responseHeaders['content-encoding'];

    for (const header in responseHeaders)
        res.set(header, responseHeaders[header]);

    if (realUpdate.status > 299 || realUpdate.status < 200)
        return res.status(realUpdate.status).send(await realUpdate.text());

    const originalData = await realUpdate.text();
    const patchedManifest = await patchManifest(originalData, responseHeaders['content-type']);

    return res.status(200).send(patchedManifest);
});

app.use((_, res) => res.sendStatus(404));

const key = await readFile(join('certs/', DOMAIN + '.key'));
const cert = await readFile(join('certs/', DOMAIN + '.crt'));
createServer({ key, cert }, app).listen(process.env.PORT || 4443);
