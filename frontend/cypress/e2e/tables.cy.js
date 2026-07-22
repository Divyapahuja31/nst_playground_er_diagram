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

    cy.visit('/');
  });

  it('1. Adds and deletes a table', () => {
    // Open modal & add table
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    // Verify table appears in sidebar and canvas
    cy.get('.flex-1.overflow-y-auto').contains('Users').should('exist');
    cy.get('.react-flow__node-tableNode').should('contain', 'Users');

    // Expand accordion & delete table
    cy.get('.flex-1.overflow-y-auto').contains('Users').click();
    cy.get('button[title="Delete table"]').click();

    // Verify table removed
    cy.get('.flex-1.overflow-y-auto').should('not.contain', 'Users');
    cy.get('.react-flow__node-tableNode').should('not.exist');
  });

  it('2. Adds columns, updates data types, and toggles field options badges', () => {
    // Add table
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    // Expand table accordion
    cy.get('.flex-1.overflow-y-auto').contains('Users').click();

    // Add field and rename to "id"
    cy.contains('button', 'Add field').click();
    cy.get('input[placeholder="field"]').clear().type('id');
    
    // Change column data type to INTEGER
    cy.get('select').first().select('INTEGER');

    // Open Field Options Popover (•••)
    cy.get('button[title="Field options"]').click();

    // Verify popover options appear
    cy.contains('Primary Key').should('be.visible');
    cy.contains('Not Null').should('be.visible');
    cy.contains('Unique').should('be.visible');
    cy.contains('Auto Increment').should('be.visible');

    // Toggle Primary Key switch
    cy.get('[role="switch"]').first().click();

    // Verify field name, data type, and 🔑 badge render on canvas node
    cy.get('.react-flow__node-tableNode').should('contain', 'id');
    cy.get('.react-flow__node-tableNode').should('contain', 'INTEGER');
    cy.get('.react-flow__node-tableNode').contains('🔑').should('be.visible');
  });

  it('3. Deletes a column field row from a table', () => {
    // Add table
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    // Expand table accordion & add field "email"
    cy.get('.flex-1.overflow-y-auto').contains('Users').click();
    cy.contains('button', 'Add field').click();
    cy.get('input[placeholder="field"]').clear().type('email');

    // Verify email is present on canvas
    cy.get('.react-flow__node-tableNode').should('contain', 'email');

    // Click delete field button (-)
    cy.get('button[title="Delete field"]').click();

    // Verify field is removed from canvas node and sidebar
    cy.get('.react-flow__node-tableNode').should('not.contain', 'email');
  });

  it('4. Filters tables using sidebar search bar', () => {
    // Add two tables: Users and Profiles
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Profiles');
    cy.contains('button', /^Add$/).click();

    // Type query "Prof" in search bar
    cy.get('input[placeholder="Search tables…"]').type('Prof');

    // Verify Profiles exists and Users is filtered out
    cy.get('.flex-1.overflow-y-auto').should('contain', 'Profiles');
    cy.get('.flex-1.overflow-y-auto').should('not.contain', 'Users');

    // Clear search bar
    cy.get('input[placeholder="Search tables…"]').clear();

    // Verify both tables appear again
    cy.get('.flex-1.overflow-y-auto').should('contain', 'Users');
    cy.get('.flex-1.overflow-y-auto').should('contain', 'Profiles');
  });
});