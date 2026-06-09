Feature: TodoMVC Add Todo

  Scenario: User adds a new todo item
    Given I go to "https://todomvc.com/examples/react/dist/"
    When I fill "What needs to be done?" with "Buy milk"
    And I press "Enter"
    Then I should see "Buy milk"
    And I should see "1 item left"