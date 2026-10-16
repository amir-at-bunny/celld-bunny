# A celld node. The app itself is not baked in: `celld deploy` uploads it to the
# bucket and the node loads it from there. Bucket credentials come from the
# Magic Containers env (CELLD_BUCKET, S3_ENDPOINT, AWS_REGION, AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY), never from the image.
FROM --platform=linux/amd64 ghcr.io/denoland/celld:v0.6.2

# Public Worker listener. A non-loopback listener requires an explicit internal
# listener; with a single node it stays on loopback since there are no peers.
ENV CELLD_ADDR=0.0.0.0:8080 \
    CELLD_INTERNAL_ADDR=127.0.0.1:7000 \
    CELLD_WATCH=/data/celld

EXPOSE 8080
