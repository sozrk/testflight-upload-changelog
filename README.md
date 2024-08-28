# Upload Test Notes to TestFlight

This action uploads a changelog for an app build in TestFlight.

The changelog will be visible to testers in the TestFlight app.

# Usage

```yaml
- uses: sozrk/testflight-upload-changelog@v1
  with:
    api_issuer_id: ${{ secrets.APPSTORE_ISSUER_ID }}
    api_key_id: ${{ secrets.APPSTORE_API_KEY_ID }}
    # The private key must be a PEM-encoded PKCS#8 key. It can either be additionally base64-encoded or not.
    api_private_key: ${{ secrets.APPSTORE_API_PRIVATE_KEY }}
    bundle_id: com.example.app
    app_version: 1.0.0
    whats_new: |
      - Added feature A
      - Fixed bug B
```

# Timeout

By default, if the action takes more than 25 minutes, it will timeout internally. You can change this by setting the `disable_default_timeout` input to true:

```yaml
- uses: sozrk/testflight-upload-changelog@v1
  timeout-minutes: 30
  with:
    disable_default_timeout: true
```
