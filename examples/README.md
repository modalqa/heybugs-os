# Example Features

Contoh feature files untuk testing public demo apps menggunakan os-heybugs.

## Test Credentials

Sauce Demo menyediakan beberapa test user:

```
Username: standard_user
Password: secret_sauce
```

Untuk locked user:
```
Username: locked_out_user
Password: secret_sauce
```

## Running Examples

### Login Tests
```bash
npm run build
node dist/cli.js run examples/saucedemo-login.feature --base-url https://www.saucedemo.com --headless
```

### Shopping Flow
```bash
node dist/cli.js run examples/saucedemo-shopping.feature --base-url https://www.saucedemo.com --headless
```

### Checkout Flow
```bash
node dist/cli.js run examples/saucedemo-checkout.feature --base-url https://www.saucedemo.com --headless
```

### Data-Driven Login
```bash
node dist/cli.js run examples/saucedemo-data-driven.feature --base-url https://www.saucedemo.com --headless
```

### TodoMVC Add Todo
```bash
node dist/cli.js run examples/todomvc-add-todo.feature --headless
```

## Step Reference

These examples use the default step registry:

- `Given I go to "<url>"` - Navigate to page
- `When I fill "<label>" with "<value>"` - Fill input field
- `When I click "<label>"` - Click button or link
- `Then I should see "<text>"` - Verify text is visible
- `And ...` - Chain additional steps

## With AI Enabled

If you have AI provider configured (.env with HEYBUGS_AI_API_KEY), the engine will also support:

- Natural language selectors (e.g., "I click on the big red button")
- Automatic selector recovery if UI changes
- Gherkin conversion with prompt

Example command with tracing:
```bash
node dist/cli.js run examples/saucedemo-login.feature --base-url https://www.saucedemo.com --trace-dir ./traces
```

Prompt example:
```bash
node dist/cli.js prompt "Open https://todomvc.com/examples/react/dist/, type Buy milk into the What needs to be done? field, press Enter, and verify Buy milk appears in the todo list and that 1 item left is shown" --execute --headed
```

## Expected Results

- **saucedemo-login.feature**: 3 scenarios, testing valid/invalid credentials
- **saucedemo-shopping.feature**: 3 scenarios, testing cart operations
- **saucedemo-checkout.feature**: 3 scenarios, testing checkout validation
- **saucedemo-data-driven.feature**: 5 data-driven login scenarios
- **todomvc-add-todo.feature**: 1 scenario, testing add-todo flow on TodoMVC React

All should pass with the provided credentials.
