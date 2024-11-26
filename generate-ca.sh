#!/bin/bash
# Largely taken from: https://gist.github.com/fntlnz/cf14feb5a46b2eda428e000157447309
set -ex

if [ "$1" = "" ]; then
    echo "usage: $0 <domain>" >&2
    echo "where <domain> is the Expo Updates server" >&2
    exit 1
fi

mkdir -p certs/ && cd certs

# CA
if [ ! -f "root.key" ]; then
    openssl genrsa -out root.key 4096
    openssl req -x509 -new -nodes -key root.key -sha256 -days 1024 -subj "/C=US/ST=CA/O=shrexpo" -out root.crt
fi

# Domain certificate
if [ ! -f "$1.key" ]; then
    openssl genrsa -out "$1.key" 2048
    openssl req -new -sha256 -key "$1.key" -subj "/C=US/ST=CA/O=shrexpo/CN=$1" -out "$1.csr"
    openssl x509 -req -in "$1.csr" -CA root.crt -CAkey root.key -CAcreateserial -out "$1.crt" -days 500 -sha256
fi

# env
cd ..;
echo "EXPO_ORIGINAL_DOMAIN=$1" > .env
echo "Now you can run: pnpm run start"
