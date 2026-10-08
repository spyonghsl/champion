# Champion Game 2026

A real-time voting and scoring web application for champion selection, built with React, TypeScript, Vite, Firebase, and Cloud Functions.

## GM Authentication and Authorization

### Prerequisites

Before deploying, you must set up GM (Game Master) authentication:

#### 1. Enable Email/Password Authentication

In Firebase Console:
1. Go to **Authentication** → **Sign-in methods**
2. Enable **Email/Password** provider
3. Save

#### 2. Create GM User Account

1. In Firebase Console, go to **Authentication** → **Users**
2. Click **Create user** and enter:
   - Email: `it_dept@rumeparkhotel.com.my`
   - Password: (Generate a strong password; never commit it to source code)
3. Copy the **User UID** from the created account

#### 3. Add GM to RTDB Allowlist

1. Go to **Realtime Database**
2. Create or navigate to `games/game001/admin/gmUids/{UID}`
3. Set the value to `true`

Example:
```
games/
  game001/
    admin/
      gmUids/
        <YOUR_GM_UID>: true
```

#### 4. Deploy Cloud Functions

```bash
npm --prefix functions run build
firebase deploy --only functions
```

#### 5. Access GM Dashboard

1. Navigate to `/gm` route in the application
2. Enter only the password (email is auto-filled as `it_dept@rumeparkhotel.com.my`)
3. Click **Sign In**

### Security Model

- **Participants**: Anonymous Firebase Authentication
- **GM Users**: Email/Password authentication, verified via RTDB allowlist
- **Backend Authorization**: Cloud Functions validate every GM action against `games/{gameId}/admin/gmUids/{uid}`
- **Error Handling**: Non-allowlisted GMs receive clear "You are not authorized as a Game Master" message

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
