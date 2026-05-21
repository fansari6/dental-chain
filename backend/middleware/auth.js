// middleware/auth.js
// Express middleware for authentication and role-based access control.
//
// Middleware functions run BEFORE the route handler.
// If they call next(), the request continues.
// If they send a response, the route handler never runs.

// Requires any valid session (any logged-in user)
export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthorized — please log in' });
  }
  next();
}

// Requires specific role(s)
// Usage: requireRole('government') or requireRole('nurse', 'supply_chain')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Unauthorized — please log in' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({
        error: `Forbidden — requires role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
}
