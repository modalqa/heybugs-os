Feature: Sauce Demo Login

  Background:
    Given I go to "https://www.saucedemo.com/"

  Scenario: User logs in with valid credentials
    When I fill "Username" with "standard_user"
    And I fill "Password" with "secret_sauce"
    And I click "Login"
    Then I should see "Products"

  Scenario: User sees error with invalid password
    When I fill "Username" with "standard_user"
    And I fill "Password" with "invalid_password"
    And I click "Login"
    Then I should see "Epic sadface"

  Scenario: User sees error with invalid username
    When I fill "Username" with "invalid_user"
    And I fill "Password" with "secret_sauce"
    And I click "Login"
    Then I should see "Epic sadface"
