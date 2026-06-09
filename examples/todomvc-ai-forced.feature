Feature: TodoMVC AI-Forced Flow

  Scenario: User adds a todo through AI-interpreted steps
    Given I go to "https://todomvc.com/examples/react/dist/"
    When I place "Buy milk" into the new todo input
    And I submit it with Enter
    Then I should see "Buy milk"
    And I should see "1 item left"