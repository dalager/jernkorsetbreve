FROM mcr.microsoft.com/playwright:v1.51.0-noble

WORKDIR /tests

# Copy test files
COPY package.json ./
RUN npm install

COPY . .

# Default command runs tests
CMD ["npx", "playwright", "test", "--reporter=list"]
