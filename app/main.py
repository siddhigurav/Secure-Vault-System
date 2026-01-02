from fastapi import FastAPI

print("Creating FastAPI app...")
app = FastAPI(
    title="Secure Vault System",
    description="A production-grade secure vault for managing sensitive metadata",
    version="1.0.0"
)

print("App created successfully")

@app.get("/health")
def health_check():
    print("Health check called")
    return {"status": "healthy"}

@app.get("/")
def read_root():
    print("Root endpoint called")
    return {"message": "Secure Vault System API"}

print("Routes defined")