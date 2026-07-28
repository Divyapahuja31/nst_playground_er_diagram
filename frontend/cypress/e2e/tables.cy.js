describe('Table Management Test Suite', () => {
  beforeEach(() => {
    // Intercept backend questions load
    cy.intercept('GET', '**/questions', {
      statusCode: 200,
      body: [{ id: '1', title: 'Test Question' }]
    }).as('getQuestions');

    cy.intercept('GET', '**/questions/1', {
      statusCode: 200,
      body: {
        id: '1',
        title: 'Test Question',
        question: 'Create table Users.'
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

  it('1. Adds and deletes a table', () => {
    cy.log('Step 1.1: Open modal & add table "Users"');
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    cy.log('Step 1.2: Verify table "Users" appears in sidebar and canvas');
    cy.get('.flex-1.overflow-y-auto').contains('Users').should('exist');
    cy.get('.react-flow__node-tableNode').should('contain', 'Users');

    cy.log('Step 1.3: Expand accordion & delete table "Users"');
    cy.get('.flex-1.overflow-y-auto').contains('Users').click();
    cy.get('button[title="Delete table"]').click();

    cy.log('Step 1.4: Verify table "Users" removed from workspace');
    cy.get('.flex-1.overflow-y-auto').should('not.contain', 'Users');
    cy.get('.react-flow__node-tableNode').should('not.exist');
  });

  it('2. Adds columns, updates data types, and toggles field options badges', () => {
    cy.log('Step 2.1: Add table "Users"');
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    cy.log('Step 2.2: Expand table accordion');
    cy.get('.flex-1.overflow-y-auto').contains('Users').click();

    cy.log('Step 2.3: Add field and rename to "id"');
    cy.contains('button', 'Add field').click();
    cy.get('input[placeholder="field"]').clear().type('id');
    
    cy.log('Step 2.4: Change column data type to INTEGER');
    cy.get('select').first().select('INTEGER');

    cy.log('Step 2.5: Open Field Options Popover');
    cy.get('button[title="Field options"]').click();

    cy.log('Step 2.6: Verify popover options appear');
    cy.contains('Primary Key').should('be.visible');
    cy.contains('Not Null').should('be.visible');
    cy.contains('Unique').should('be.visible');
    cy.contains('Auto Increment').should('be.visible');

    cy.log('Step 2.7: Toggle Primary Key switch');
    cy.get('[role="switch"]').first().click();

    cy.log('Step 2.8: Verify field name, data type, and primary key badge on canvas node');
    cy.get('.react-flow__node-tableNode').should('contain', 'id');
    cy.get('.react-flow__node-tableNode').should('contain', 'INTEGER');
    cy.get('.react-flow__node-tableNode').contains('🔑').should('be.visible');
  });

  it('3. Deletes a column field row from a table', () => {
    cy.log('Step 3.1: Add table "Users"');
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    cy.log('Step 3.2: Expand table accordion & add field "email"');
    cy.get('.flex-1.overflow-y-auto').contains('Users').click();
    cy.contains('button', 'Add field').click();
    cy.get('input[placeholder="field"]').clear().type('email');

    cy.log('Step 3.3: Verify email is present on canvas');
    cy.get('.react-flow__node-tableNode').should('contain', 'email');

    cy.log('Step 3.4: Click delete field button');
    cy.get('button[title="Delete field"]').click();

    cy.log('Step 3.5: Verify field is removed from canvas node and sidebar');
    cy.get('.react-flow__node-tableNode').should('not.contain', 'email');
  });

  it('4. Filters tables using sidebar search bar', () => {
    cy.log('Step 4.1: Add two tables: Users and Profiles');
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Profiles');
    cy.contains('button', /^Add$/).click();

    cy.log('Step 4.2: Type query "Prof" in search bar');
    cy.get('input[placeholder="Search tables…"]').type('Prof');

    cy.log('Step 4.3: Verify Profiles exists and Users is filtered out');
    cy.get('.flex-1.overflow-y-auto').should('contain', 'Profiles');
    cy.get('.flex-1.overflow-y-auto').should('not.contain', 'Users');

    cy.log('Step 4.4: Clear search bar');
    cy.get('input[placeholder="Search tables…"]').clear();

    cy.log('Step 4.5: Verify both tables appear again');
    cy.get('.flex-1.overflow-y-auto').should('contain', 'Users');
    cy.get('.flex-1.overflow-y-auto').should('contain', 'Profiles');
  });
});