describe('Relationships Management Test', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/questions', {
      statusCode: 200,
      body: [{ id: '1', title: 'Test Question' }]
    }).as('getQuestions');

    cy.intercept('GET', '**/questions/1', {
      statusCode: 200,
      body: {
        id: '1',
        title: 'Test Question',
        question: 'Connect Users and Profiles.'
      }
    }).as('getQuestionDetail');

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth_token', 'fake-token');
        win.localStorage.setItem('auth_user', JSON.stringify({ id: '1', role: 'STUDENT', full_name: 'Test Student' }));
      }
    });
    cy.wait('@getQuestions');
    cy.contains('Solve Assignment').click();
  });

  it('allows creating tables, switching to relations tab, and editing relationship properties', () => {
    // 1. Add Users table
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    // 2. Add Profiles table
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Profiles');
    cy.contains('button', /^Add$/).click();

    // 3. Add column 'id' to Users
    cy.get('.flex-1.overflow-y-auto').contains('Users').click();
    cy.contains('button', 'Add field').click();
    cy.get('input[placeholder="field"]').first().clear().type('id');

    // 4. Add column 'user_id' to Profiles
    cy.get('.flex-1.overflow-y-auto').contains('Profiles').click();
    cy.contains('button', 'Add field').click();
    cy.get('input[placeholder="field"]').last().clear().type('user_id');

    // 5. Connect handles via deterministic test helper
    cy.window().then((win) => {
      const usersTable = win.__testTables.find((t) => t.name === 'Users');
      const profilesTable = win.__testTables.find((t) => t.name === 'Profiles');

      win.__testConnect({
        source: usersTable.id,
        target: profilesTable.id,
        sourceHandle: 'source-id',
        targetHandle: 'target-user_id',
      });
    });

    // 6. Switch to Relations tab
    cy.contains('button', 'Relations').click();

    // 7. Verify relationship exists or search filters it
    cy.get('input[placeholder="Search relations…"]').type('users');
    cy.get('.flex-1.overflow-y-auto').should('contain', 'users_profiles_rel');
    cy.get('input[placeholder="Search relations…"]').clear();

    // 8. Expand relationship item and edit properties if present
    cy.get('.flex-1.overflow-y-auto').contains('users_profiles_rel').click();
    cy.get('input[value="users_profiles_rel"]').type('{selectall}{backspace}user_profile_link');
    cy.get('.flex-1.overflow-y-auto').find('select').first().select('One to Many');

    // 9. Verify name updated
    cy.get('.flex-1.overflow-y-auto').should('contain', 'user_profile_link');

    // 10. Delete relationship
    cy.get('button[title="Delete relationship"]').click();
    cy.get('.flex-1.overflow-y-auto').should('not.contain', 'user_profile_link');
  });
});
