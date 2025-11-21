# Blog

This is a Jekyll blog that automatically deploys to GitHub Pages.

## Deployment

### Production Deployment

The site automatically deploys to GitHub Pages when changes are pushed to the `main` branch via the `.github/workflows/jekyll.yml` workflow.

### PR Preview Deployments

Every pull request automatically generates a preview deployment via the `.github/workflows/preview-deploy.yml` workflow.

#### How PR Previews Work

1. **Automatic Build**: When a PR is opened or updated, the workflow automatically builds the Jekyll site
2. **Artifact Upload**: The built site is uploaded as a GitHub Actions artifact (available for 7 days)
3. **Optional Live Preview**: If configured, the site can be deployed to Netlify, Vercel, or Cloudflare Pages
4. **PR Comment**: A comment is automatically posted on the PR with links to download or view the preview
5. **Auto-Update**: The preview updates automatically with each new commit to the PR
6. **Cleanup**: When the PR is closed, a cleanup comment is posted

#### Download Preview

By default, preview builds are available as downloadable artifacts. To access:

1. Go to the PR's "Checks" tab
2. Click on the "Deploy PR Preview" workflow run
3. Download the `preview-site-pr-[number]` artifact
4. Extract and serve locally (e.g., with `python -m http.server` or any static file server)

#### Optional: Live Preview Deployment

To enable live preview deployments, configure one or more of the following services:

##### Netlify

Add these secrets to your repository:
- `NETLIFY_AUTH_TOKEN`: Your Netlify personal access token
- `NETLIFY_SITE_ID`: Your Netlify site ID

##### Vercel

Add these secrets to your repository:
- `VERCEL_TOKEN`: Your Vercel token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

##### Cloudflare Pages

Add these secrets to your repository:
- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

## Local Development

### Prerequisites

- Ruby 3.4.5 or compatible version
- Bundler gem

### Setup

```bash
# Install dependencies
bundle install

# Build the site
bundle exec jekyll build

# Serve the site locally
bundle exec jekyll serve
```

The site will be available at `http://localhost:4000`.

## License

See the blog content for individual post licenses.
