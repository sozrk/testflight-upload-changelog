# Upload Test Notes to TestFlight

This action uploads a changelog for an app build in TestFlight.

The changelog will be visible to testers in the TestFlight app.

# Usage

```yaml
- uses: sozrk/testflight-upload-changelog@v1
  with:
    api_issuer_id: ${{ secrets.APPSTORE_ISSUER_ID }}
    api_key_id: ${{ secrets.APPSTORE_API_KEY_ID }}
    # The private key must be a PEM-encoded PKCS#8 key.
    # It can additionally be base64-encoded but doesn't have to.
    api_private_key: ${{ secrets.APPSTORE_API_PRIVATE_KEY }}
    bundle_id: com.example.app
    app_version: 1.0.0
    whats_new: |
      - Added feature A
      - Fixed bug B
```

# Timeout

By default, if the action takes more than 25 minutes, it will timeout internally. You can change this by setting the `disable_default_timeout` field to `true`:

```yaml
- uses: sozrk/testflight-upload-changelog@v1
  timeout-minutes: 30
  with:
    # ...
    disable_default_timeout: true
```

# Handle fixable errors

If the `whats_new` field contains invalid characters, such as emojis, the action will automatically remove them, and if it's too long, it will be automatically trimmed. This behaviour can be disabled by setting the `auto_fix_content` field to `false`:

```yaml
- uses: sozrk/testflight-upload-changelog@v1
  with:
    # ...
    auto_fix_content: false # defaults to true
```
