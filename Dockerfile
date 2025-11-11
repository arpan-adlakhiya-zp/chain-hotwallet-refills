FROM nikolaik/python-nodejs:python3.12-nodejs18 AS builder
WORKDIR /opt/chain-hotwallet-refills
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libtool \
    libc6-dev \
    build-essential \
    autoconf \
    automake \
    pkg-config \
    git \
    python3 \
    ca-certificates \
    curl && \
    curl -fsSLo /usr/local/share/ca-certificates/rds-global-bundle.pem \
         https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem && \
    update-ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
RUN groupadd -r appuser && useradd -r -g appuser -m appuser

# Stage 2: Install Node.js dependencies
FROM builder AS dependencies
ARG NPMRC
COPY package*.json ./
ENV npm_config_cache=/root/.npm
RUN --mount=type=secret,id=ENV_FILE \
    base64 -d /run/secrets/ENV_FILE > /root/.npmrc && \
    npm install --legacy-peer-deps && \
    rm -rf /root/.npmrc

# Stage 3: Final image using the builder as base
FROM builder
COPY --from=dependencies /opt/chain-hotwallet-refills/node_modules ./node_modules
COPY . .
RUN chown -R appuser:appuser /opt/chain-hotwallet-refills
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/rds-global-bundle.pem
USER appuser
ENTRYPOINT ["node", "src/index.js"]