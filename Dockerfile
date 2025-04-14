# Use Node.js LTS image
FROM node:18

# Create app directory
WORKDIR /app

# Copy files
COPY package*.json ./
COPY . .

# Install dependencies
RUN npm install

# Expose the bot port (optional)
EXPOSE 3000

# Add labels for GitHub association
LABEL org.opencontainers.image.source="https://github.com/JornickVn/DiscordBot"
LABEL org.opencontainers.image.description="A Discord bot built with Node.js"

# Run the bot
CMD ["node", "index.js"]
