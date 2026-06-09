Feature: Basic login flow

  Background:
    Given I go to "/login"

  Scenario: User signs in
    When I fill "Email" with "demo@example.com"
    And I fill "Password" with "secret"
    And I click "Sign in"
    Then I should see "Dashboard"
