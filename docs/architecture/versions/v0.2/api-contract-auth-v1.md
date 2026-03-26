# API Contract Snapshot - Auth v1

Base Prefix: `/v1/auth`

## POST /register
Request:
```json
{ "email": "user@example.com", "password": "Password123" }
```
Response `201`:
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "user@example.com", "role": "student", "createdAt": "...", "updatedAt": "..." },
    "tokens": { "accessToken": "...", "refreshToken": "..." }
  }
}
```

## POST /login
Request:
```json
{ "email": "user@example.com", "password": "Password123" }
```
Response `200` success envelope with user + tokens.

## POST /refresh
Request:
```json
{ "refreshToken": "..." }
```
Response `200` success envelope with rotated tokens.

## POST /logout
Request:
```json
{ "refreshToken": "..." }
```
Response `204` no body.

## GET /me
Header: `Authorization: Bearer <accessToken>`
Response `200`:
```json
{ "success": true, "data": { "user": { "id": "...", "email": "...", "role": "student", "createdAt": "...", "updatedAt": "..." } } }
```

## Standard Error
```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_ACCESS",
    "message": "Invalid access token.",
    "details": null
  }
}
```

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

