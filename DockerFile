# Use Node.js LTS version
FROM node:18

# Create and set the app directory
WORKDIR /app

# Copy the package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your app will run on (optional)
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]
