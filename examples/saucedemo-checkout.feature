Feature: Sauce Demo Checkout Flow

  Background:
    Given I go to "https://www.saucedemo.com/"
    When I fill "Username" with "standard_user"
    And I fill "Password" with "secret_sauce"
    And I click "Login"
    And I click "Add to cart"
    And I click "1"
    Then I should see "Your Cart"

  Scenario: User completes checkout with valid info
    When I click "Checkout"
    And I fill "First Name" with "John"
    And I fill "Last Name" with "Doe"
    And I fill "Postal Code" with "12345"
    And I click "Continue"
    Then I should see "Finish"