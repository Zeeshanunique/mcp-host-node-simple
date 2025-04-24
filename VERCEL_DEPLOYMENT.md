# Vercel Deployment Guide

This guide explains how to deploy the application to Vercel, which will host both the frontend and backend.

## Prerequisites

1. A [Vercel](https://vercel.com) account
2. [Vercel CLI](https://vercel.com/docs/cli) installed (optional for local testing)

## Deployment Steps

### 1. Fork or Clone the Repository

Make sure you have a copy of the repository in your own GitHub account.

### 2. Connect to Vercel

1. Log in to your Vercel account
2. Click "Add New..."
3. Select "Project"
4. Import your GitHub repository 
5. Configure the project:
   - Framework Preset: Other
   - Build Command: `npm run vercel-build`
   - Output Directory: `src/frontend/build`
   - Install Command: `npm run install:all`

### 3. Environment Variables

Add all required environment variables from your `.env` file to the Vercel project:

1. Go to Project Settings > Environment Variables
2. Add the following variables:
   - All API keys and configuration needed for your application
   - Set `NODE_ENV` to `production`

### 4. Deploy

Click "Deploy" and wait for the build to complete.

## Local Testing

To test the Vercel deployment locally:

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel login`
3. Run `vercel` in the project directory to test the deployment locally
4. Or run `vercel --prod` to deploy directly to production

## Troubleshooting

If you encounter issues with the deployment:

1. Check Vercel build logs for errors
2. Ensure all environment variables are correctly set
3. Verify that the build process completes successfully
4. Check API routes in the Vercel dashboard to confirm they're working properly

## Notes

- The application uses a serverless function for the backend API
- Static assets are served from the frontend build directory
- API routes are prefixed with `/api` 