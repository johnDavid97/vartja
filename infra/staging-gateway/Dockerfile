FROM caddy:2.11.9-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0
COPY Caddyfile /etc/caddy/Caddyfile
COPY entrypoint.sh /usr/local/bin/staging-gateway
# TLS terminates at Railway. No admin API, writable config, or privileged port.
ENV XDG_CONFIG_HOME=/tmp/caddy-config
ENV XDG_DATA_HOME=/tmp/caddy-data
USER 1000:1000
EXPOSE 3000
ENTRYPOINT ["/bin/sh", "/usr/local/bin/staging-gateway"]
