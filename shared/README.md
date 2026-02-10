# Firebase Configuration

This directory contains Firebase configuration files for the CampusHub project.

## Files

- `firestore.rules.example` - Example Firestore security rules
- `firestore.indexes.json` - Database indexes configuration
- `schema.md` - Database schema documentation (public version)
- `config.example.js` - Firebase config template

## Setup

1. Copy `.env.example` to `.env` in each project (mobile, web, desktop)
2. Fill in your Firebase credentials
3. Never commit real credentials to Git

## Security

⚠️ **NEVER commit:**
- Real API keys
- Production credentials
- Detailed security rules