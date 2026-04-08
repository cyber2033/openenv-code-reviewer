# Stage 1: Build the Dashboard
FROM node:20-slim AS build-stage
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ .
RUN npm run build

# Stage 2: Serve with Python
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONPATH=/app/code-review-env

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Project Files
COPY . .

# Copy Built Dashboard from Stage 1
COPY --from=build-stage /app/dashboard/dist ./dashboard/dist

# Expose the standard port
EXPOSE 7860

# Command to run the application
# We use uvicorn to start the server
CMD ["python", "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "7860"]
