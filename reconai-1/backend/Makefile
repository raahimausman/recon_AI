# Makefile
.PHONY: build run test clean
build:
	docker build -t backend-service .
run:
	docker run -d -p 5000:5000 backend-service
test:
	docker run --rm backend-service pytest
clean:	
	docker rmi backend-service || true
	docker system prune -f	