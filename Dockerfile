# 1. Use an official Puppeteer image
FROM ghcr.io/puppeteer/puppeteer:21.5.2

# 2. Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    # CRITICAL: Tell Node.js to use a maximum of 400MB of RAM
    NODE_OPTIONS="--max-old-space-size=400"

# 3. Set the working directory
WORKDIR /usr/src/app

# 4. Copy and install dependencies
COPY package*.json ./
RUN npm ci

# 5. Copy the rest of your code
COPY . .

# 6. Start the server
CMD [ "node", "server.js" ]