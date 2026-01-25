# Store-B API Security

This API implements comprehensive security measures to protect against common vulnerabilities.

## Security Features

### 🛡️ Authentication & Authorization
- **JWT-based authentication** with secure token generation
- **Role-based access control (RBAC)** for admin and customer roles
- **Password hashing** using bcrypt with 12 salt rounds
- **Token expiration** set to 24 hours

### 🚦 Rate Limiting
- **General API rate limit**: 100 requests per 15 minutes per IP
- **Auth endpoints rate limit**: 5 login/register attempts per 15 minutes per IP
- Prevents brute force and DDoS attacks

### 🔒 Security Headers (Helmet)
- Content Security Policy (CSP)
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options (MIME sniffing protection)
- Strict-Transport-Security (HTTPS enforcement)

### ✅ Input Validation
- All user inputs are validated and sanitized
- Strong password requirements (min 8 chars, uppercase, lowercase, number, special char)
- Email format validation
- SQL injection protection via parameterized queries

### 🌐 CORS Configuration
- Restricted to specific frontend origins
- Credentials support enabled
- Controlled HTTP methods

### 📝 Request Logging
- Development: Concise logging with `morgan('dev')`
- Production: Detailed logging with `morgan('combined')`

### 🔐 Additional Protections
- HTTP Parameter Pollution (HPP) protection
- Payload size limits (10MB)
- Secure database connections with SSL

## API Endpoints Security

### Public Endpoints (No Authentication)
- `GET /api/health` - Health check
- `GET /api/products` - List all products
- `GET /api/products/featured` - List featured products
- `GET /api/categories` - List all categories
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Authenticated Endpoints (Requires Valid JWT)
- `POST /api/orders` - Create order (users create their own orders)
- `GET /api/orders` - Get orders (users see only their orders, admins see all)

### Admin-Only Endpoints (Requires Admin Role)
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `PUT /api/orders/:id` - Update order status
- `GET /api/stats` - View statistics

## Environment Variables

See `.env.example` for required environment variables. Key security-related variables:

- `JWT_SECRET` - Must be a strong, random secret (minimum 32 characters)
- `NODE_ENV` - Set to 'production' in production environments
- `FRONTEND_URL` - Your frontend domain for CORS
- `ADMIN_URL` - Your admin dashboard domain for CORS

## Password Requirements

Passwords must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&#)

## Best Practices

1. **Never expose sensitive data** in API responses
2. **Use HTTPS** in production
3. **Rotate JWT secrets** regularly
4. **Monitor rate limit violations** for suspicious activity
5. **Keep dependencies updated** to patch security vulnerabilities
6. **Use environment variables** for all sensitive configuration
7. **Enable request logging** in production for security audits

## Testing Security

### Test Rate Limiting
```bash
# Make multiple rapid requests to trigger rate limit
for i in {1..101}; do curl http://localhost:5000/api/products; done
```

### Test Authentication
```bash
# Try accessing admin endpoint without token (should fail)
curl -X POST http://localhost:5000/api/products

# Login and use token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourPassword"}'
```

### Test RBAC
```bash
# Try accessing admin endpoint as customer (should fail)
curl -X DELETE http://localhost:5000/api/products/1 \
  -H "Authorization: Bearer <customer_token>"
```

## Security Incident Response

If you suspect a security breach:
1. Check request logs for suspicious activity
2. Rotate JWT secret immediately
3. Force all users to re-authenticate
4. Review database for unauthorized changes
5. Update passwords for admin accounts

## Contact

For security vulnerabilities, please contact the development team immediately.
