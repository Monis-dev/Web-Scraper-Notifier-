# 1. Use an official Puppeteer image (Comes with Node + Chrome installed)
FROM ghcr.io/puppeteer/puppeteer:21.5.2

# 2. Skip downloading Chrome again (because the image already has it)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# 3. Set the working directory
WORKDIR /usr/src/app

# 4. Copy package files
COPY package*.json ./

# 5. Install dependencies
RUN npm ci

# 6. Copy the rest of your code
COPY . .

# 7. Start the server
CMD [ "node", "server.js" ]