Feature: User Management

  Background:
    Given I am logged in as admin

  Scenario: Create a new user
    When I create a user with name "Test User" and email "test@example.com"
    Then the user list should contain "Test User"

  Scenario: Delete a user
    Given user "Test User" exists
    When I delete user "Test User"
    Then the user list should not contain "Test User"
