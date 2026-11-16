describe('Teacher SQL Query Spec Interface Test', () => {
  beforeEach(() => {
    cy.intercept('GET', 'http://localhost:8000/questions', {
      statusCode: 200,
      body: [
        { id: '101', title: 'Hospital System', question: 'Design hospital schema', is_published: true, has_spec: true },
      ]
    }).as('getQuestions');

    cy.intercept('GET', 'http://localhost:8000/questions/101*', {
      statusCode: 200,
      body: {
        id: '101',
        title: 'Hospital System',
        question: 'Design hospital schema with Patient and Doctor.',
        created_by: 'teacher-1',
        has_spec: true,
      }
    }).as('getQuestionDetail');

    cy.intercept('GET', 'http://localhost:8000/questions/101/spec', {
      statusCode: 200,
      body: {
        version: 1,
        entities: [
          {
            name: 'Patient',
            attributes: [
              { name: 'patient_id', data_type: 'INTEGER', is_primary_key: true, is_not_null: true, is_unique: true, required: true },
              { name: 'name', data_type: 'VARCHAR', is_primary_key: false, is_not_null: true, is_unique: false, required: true },
            ]
          }
        ],
        relationships: [],
        sql_tests: [
          {
            name: 'insert_valid_patient',
            description: 'Insert valid patient record',
            kind: 'raw_sql',
            operation: {
              sql: "INSERT INTO Patient (patient_id, name) VALUES (1, 'John Doe');"
            },
            expect_success: true,
            marks: 10.0
          }
        ],
        marks: {
          entities_and_attributes: 25.0,
          relationships_and_cardinalities: 25.0,
          keys_and_constraints: 25.0,
          sql_behavioral_tests: 25.0
        }
      }
    }).as('getSpec');

    cy.intercept('PUT', 'http://localhost:8000/questions/101/spec', {
      statusCode: 200,
      body: { ok: true }
    }).as('saveSpec');
  });

  it('allows teacher to open SQL Test Queries modal and inspect/add queries', () => {
    cy.visit('/questions/101', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth_token', 'fake-teacher-token');
        win.localStorage.setItem('auth_user', JSON.stringify({ id: 'teacher-1', role: 'TEACHER', full_name: 'Professor Smith' }));
      }
    });

    cy.wait('@getQuestionDetail');

    // Verify teacher sees SQL Test Queries button in Navbar
    cy.contains('button', '⚙️ SQL Test Queries').should('be.visible').click();
    cy.wait('@getSpec');

    // Modal opens
    cy.contains('SQL Query Validation Suite').should('be.visible');
    cy.contains('insert_valid_patient').should('be.visible');
    cy.contains('INSERT INTO Patient').should('be.visible');

    // Click "+ Add Test Query"
    cy.contains('button', '+ Add Test Query').click();
    cy.contains('label', 'Test Name (Identifier)').should('be.visible');

    // Save spec
    cy.contains('button', '💾 Save & Activate SQL Test Suite').click();
    cy.wait('@saveSpec');
    cy.contains('✓ SQL Test Suite and validation spec saved successfully!').should('be.visible');

    // Close modal
    cy.contains('button', 'Close').click();
    cy.contains('SQL Query Validation Suite').should('not.exist');
  });
});