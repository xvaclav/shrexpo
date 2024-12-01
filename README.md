# shrexpo
A code patcher for over-the-air [Expo Updates](https://docs.expo.dev/versions/latest/sdk/updates/)

The purpose of this patcher is to demonstrate the ability to patch OTA application updates.
The patcher is very primitive, and only does a search-and-replace operation on the application
code blob. Since the blob is typically Hermes bytecode, it would be necessary to dissassemble
and reassemble the bytecode in order to make any more significant changes. This is out of scope
for this experiment (Although I would find it very cool if someone managed to do this!)

## Usage
Before trying to use this project, you must choose an app which uses Expo, expo-updates, and does not
have code signing enabled. For the thesis demonstration, I used [graysky](https://graysky.app/download)
v1.50 by mozzius, which fulfills all these conditions at the time of writing this. You then need to
extract the app and read the `expo.modules.updates.EXPO_UPDATE_URL` entry in `AndroidManifest.xml`,
which tells you the URL the app uses to check for updates.

This project is intended to be ran on Linux or any UN*X-based system (such as macOS). If you are on a
different operating system, please reconsider.

To run the server, you'll first need to install openssl, [Node.js](https://node.js) >=20 and pnpm >=9
onto your system. If you have these programs, you may run `./generate-ca.sh <domain>`, where `<domain>`
is the domain you got from EXPO_UPDATE_URL. You may also use Docker and the attached `compose.yml` file
to run this project in a container, along with a DNS server for spoofing the update server IP, in which
case you do not need to install any of the abovementioned software.

This script will generate a self-signed CA for the server, as well as an .env file. Before starting
the server, you will need to add a few more entries to the .env file. These entries are:
- `PORT` - this should be `443` if you intend to actually use this to intercept updates.
           otherwise, it can be set to something like `4443` in order to be able to run it
           as a non-root user.
- `ORIGIN` - the base path where this server will be accessible, used for the modified asset URL in
             the manifest. I recommend this to be the URL of the `EXPO_ORIGINAL_DOMAIN`
             (e.g. if your `EXPO_ORIGINAL_DOMAIN` is `bla.example`, then ORIGIN should be `https://bla.example/`).
- `SEARCH_STRING` - The string which will be searched in the binary blob
- `REPLACE_STRING` - The string which will replace `SEARCH_STRING`

An example of such file is provided in `.env.example`. Once the environment file is configured, you may
run `pnpm run start` (or `docker compose up -d`) to start the patcher server. You will then need to
install the root certificate found in `certs/root.crt` onto the Android device, and somehow intercept
its request to the original update server.

## Caveats
The patcher, in its current state, only works in the following conditions (from most to least work-around-able):
- The user's app is out of date (meaning there is an available update)

- The replacement string is the same length as the searched-for string. This restriction is in
  place to not break the Hermes bytecode structure (since the way we modify it is *very* primitive).

- The targeted app's build process generates Hermes bytecode to distribute the application code.

- The user's connection to the app update server is hijacked in some fashion
  (via manipulating the DNS record, intercepting the TLS packets, or any other method).

- The user has the patcher's root certificate installed
  (or you have successfully compromised a legitimate root CA and can issue a certificate for yourself)

- The app that is being patched does not have [end-to-end code signing](https://docs.expo.dev/eas-update/code-signing/) enabled.

Removing or working around any of these caveats is left as an exercise to the reader. :)

## License
AGPL-3.0-only; see [LICENSE](LICENSE)
