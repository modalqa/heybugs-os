Feature: Sauce Demo Data-Driven Login

  Background:
    Given I go to "https://www.saucedemo.com/"

  Scenario Outline: User logs in with different credentials
    When I fill "Username" with "<username>"
    And I fill "Password" with "<password>"
    And I click "Login"
    Then I should see "<expected_result>"

    Examples:
      | username           | password     | expected_result |
      | standard_user      | secret_sauce | Products        |
      | locked_out_user    | secret_sauce | Epic sadface    |
      | problem_user       | secret_sauce | Products        |
      | performance_glitch_user | secret_sauce | Products |
      | invalid_user       | wrong_pass   | Epic sadface    |
