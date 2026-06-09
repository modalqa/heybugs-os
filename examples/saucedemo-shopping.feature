Feature: Sauce Demo Shopping Flow

  Background:
    Given I go to "https://www.saucedemo.com/"
    When I fill "Username" with "standard_user"
    And I fill "Password" with "secret_sauce"
    And I click "Login"
    Then I should see "Products"

  Scenario: User adds product to cart
    When I click "Add to cart" for "Sauce Labs Backpack"
    Then I should see "Remove"

  Scenario: User views cart
    When I click "Add to cart" for "Sauce Labs Backpack"
    And I click "1"
    Then I should see "Your Cart"

  Scenario: User continues shopping
    When I click "Add to cart"
    And I click "1"
    And I click "Continue Shopping"
    Then I should see "Products"
