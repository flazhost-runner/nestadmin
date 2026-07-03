Feature: Authentication

  Scenario: Admin can login with valid credentials
    Given I am on the login page
    When I submit email "admin@test.com" and password "testpassword123"
    Then I should be redirected to dashboard
    And I should see "Welcome"

  Scenario: Login fails with wrong password
    Given I am on the login page
    When I submit email "admin@test.com" and password "wrongpassword"
    Then I should see an error message

  Scenario: Logout invalidates session
    Given I am logged in as admin
    When I logout
    Then I cannot access admin pages
