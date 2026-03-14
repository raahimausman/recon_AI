# Dockerfile
FROM python:3.11-slim
LABEL maintainer="Your Name <your.email@example.com>"
LABEL description="Backend service for the application"
LABEL version="1.0"
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "app.py"]