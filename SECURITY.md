# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Standalone Scanner Risks

The **Standalone Scanner** (`standalone/a11y-scan.html`) is a powerful tool designed to run *inside* your website's context. Because it runs in the browser of the user visiting it, it inherits that user's permissions.

### 1. The "Authenticated Context" Risk
If an administrator logs into your CMS (e.g., WordPress, Drupal) and then visits `https://yoursite.com/a11y-scan.html`, the scanner runs with **Administrator privileges**.
*   **Risk:** It can scan and read pages that are normally protected behind a login.
*   **Mitigation:** 
    *   **Never deploy the scanner to a production environment** unless it is behind its own authentication layer (Basic Auth, VPN, etc.).
    *   Use it primarily on Staging or Development environments.

### 2. Denial of Service (DoS) Risk
The scanner works by loading pages in your site rapidly (via iframes) to analyze them.
*   **Risk:** If exposed publicly, a malicious actor could trigger the scanner repeatedly, causing your server to handle thousands of requests in a short time. This acts like a "Self-DDoS" button.
*   **Mitigation:**
    *   The scanner now enforces a minimum delay (throttling) between page loads.
    *   **Gate access** using the provided `.htaccess` example or your server's access control method.

## Reporting a Vulnerability

If you discover a vulnerability in the *scanner logic* itself (e.g., XSS in the report viewer), please open a GitHub Issue or contact the maintainer directly.

## Recommended Access Control

We strongly recommend using **Basic Authentication** or IP restrictions for the standalone scanner.

Example `.htaccess` (Apache):
```apache
<Files "a11y-scan.html">
  AuthType Basic
  AuthName "Restricted Accessibility Scanner"
  AuthUserFile /path/to/.htpasswd
  Require valid-user
</Files>
```
