# Secure Vault System

A production-grade secure vault system for managing sensitive company metadata using Python FastAPI backend and vanilla HTML/CSS/JavaScript frontend.

## Architecture

### Clean Architecture

The system follows clean architecture principles with strict separation of concerns:

- **API Layer** (`app/api/`): Request/response handling only. No business logic.
- **Service Layer** (`app/services/`): Business logic, orchestration.
- **Core Layer** (`app/core/`): Security, permissions, configuration.
- **Models** (`app/models/`): SQLAlchemy domain models.
- **Schemas** (`app/schemas/`): Pydantic validation models.

### Security Design

#### Authentication
- JWT-based authentication with short-lived access tokens (15 minutes) and refresh tokens (7 days).
- Passwords hashed using Argon2.
- Tokens invalidated on logout/refresh.

#### Authorization
- Role-Based Access Control (RBAC) with Policy-Based Authorization.
- Authorization flow: User → Roles → Policies → Decision.
- Policies define allowed actions (read, write, rotate, delete) on resources (secrets).
- Deny-by-default: Access granted only when explicitly allowed by policies.

#### Secret Management
- Secrets encrypted at rest using AES-256-GCM.
- Encryption key stored securely (in production, use HSM or KMS).
- Secrets never stored or logged in plaintext.
- Secret versioning for rotation.
- Masked by default; explicit permission required to reveal.

#### Audit Logging
- Immutable audit logs for all sensitive actions.
- Logs include: user_id, action, resource_id, timestamp, IP.
- No secrets in logs.

### Threat Model

#### Threats Addressed
- **Data Breach**: Encryption prevents plaintext exposure.
- **Unauthorized Access**: RBAC and policies enforce access control.
- **Insider Threats**: Audit logs track all actions.
- **Credential Theft**: Short-lived tokens, hashed passwords.
- **Data Tampering**: Immutable logs, versioned secrets.

#### Assumptions
- Database is secure and access-controlled.
- Encryption keys are protected.
- Network traffic is encrypted (HTTPS).
- Users are authenticated via secure channels.

#### Tradeoffs
- **Performance vs Security**: Encryption/decryption adds overhead.
- **Complexity vs Flexibility**: Policy-based auth is powerful but complex.
- **Storage vs Auditability**: Full audit logs increase storage needs.
- **Usability vs Security**: Masked secrets require explicit reveal actions.

## Quick Start (Backend + Frontend)

1. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Set up environment variables in `.env` (see Setup section)

3. Run database migrations and seed data:
   ```bash
   alembic upgrade head
   python seed.py
   ```

4. Start both servers:
   ```bash
   python dev.py
   ```

5. Open [http://localhost:3000](http://localhost:3000) for the frontend

This will start both the FastAPI backend (port 8000) and React frontend (port 3000).

## Docker Deployment

1. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

2. The API will be available at `http://localhost:8000`

3. Database at `localhost:5432`

## Frontend Setup

The system includes a modern vanilla HTML/CSS/JavaScript frontend for easy management.

### Features
- **No Build Tools Required**: Pure HTML/CSS/JavaScript that runs directly in the browser
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, professional interface with smooth animations
- **Real-time Updates**: Automatic token refresh and error handling
- **Security**: JWT-based authentication with secure API communication

### Running the Frontend

The frontend is automatically served when you run `python dev.py`. It will be available at:

- **Frontend UI**: http://127.0.0.1:3000

### Manual Frontend Serving

If you need to serve the frontend separately:

```bash
cd static
python -m http.server 3000
```

Then open http://127.0.0.1:3000 in your browser.

### Default Credentials
- Username: `admin`
- Password: `admin123`

The frontend automatically proxies API requests to the backend running on port 8000.

## API Endpoints

### Authentication
- `POST /api/v1/auth/login`: User login
- `POST /api/v1/auth/refresh`: Refresh access token

### Users
- `POST /api/v1/users`: Create user
- `GET /api/v1/users`: List users
- `GET /api/v1/users/{id}`: Get user
- `PUT /api/v1/users/{id}`: Update user
- `DELETE /api/v1/users/{id}`: Delete user

### Roles
- `POST /api/v1/roles`: Create role
- `GET /api/v1/roles`: List roles
- `GET /api/v1/roles/{id}`: Get role
- `PUT /api/v1/roles/{id}`: Update role
- `DELETE /api/v1/roles/{id}`: Delete role

### Policies
- `POST /api/v1/policies`: Create policy
- `GET /api/v1/policies`: List policies
- `GET /api/v1/policies/{id}`: Get policy
- `PUT /api/v1/policies/{id}`: Update policy
- `DELETE /api/v1/policies/{id}`: Delete policy

### Secrets
- `POST /api/v1/secrets`: Create secret
- `GET /api/v1/secrets`: List secrets (masked)
- `GET /api/v1/secrets/{id}`: Get secret (masked)
- `GET /api/v1/secrets/{id}/reveal`: Reveal secret value
- `PUT /api/v1/secrets/{id}/rotate`: Rotate secret
- `DELETE /api/v1/secrets/{id}`: Delete secret

### Audit
- `GET /api/v1/audit/logs`: Query audit logs

## Development

- Use type hints everywhere.
- Run tests: `pytest`
- Format code: `black .`
- Lint: `mypy .`

## Production Considerations

- Use managed PostgreSQL with backups.
- Store encryption keys in HSM/KMS.
- Enable HTTPS.
- Monitor audit logs.
- Implement rate limiting.
- Use secrets management for config values.