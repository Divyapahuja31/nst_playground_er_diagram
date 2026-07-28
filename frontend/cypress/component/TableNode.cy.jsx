import { ReactFlowProvider } from '@xyflow/react';
import TableNode from '../../src/components/TableNode';

describe('<TableNode /> Component', () => {
  const mockData = {
    label: 'CUSTOMER',
    columns: [
      { name: 'customer_id', type: 'INTEGER', isPrimary: true },
      { name: 'name', type: 'VARCHAR', isPrimary: false },
      { name: 'created_at', type: 'TIMESTAMP', isPrimary: false },
    ],
  };

  const mountNode = (data) => {
    return cy.mount(
      <ReactFlowProvider>
        <TableNode data={data} />
      </ReactFlowProvider>
    );
  };

  it('renders table header, columns, and data type colors correctly', () => {
    cy.log('Step 1.1: Mount TableNode with ReactFlowProvider');
    mountNode(mockData);

    cy.log('Step 1.2: Check header text content');
    cy.contains('CUSTOMER').should('be.visible');

    cy.log('Step 1.3: Check all column labels are visible');
    cy.contains('customer_id').should('be.visible');
    cy.contains('name').should('be.visible');
    cy.contains('created_at').should('be.visible');

    cy.log('Step 1.4: Check column data types are visible');
    cy.contains('INTEGER').should('be.visible');
    cy.contains('VARCHAR').should('be.visible');
    cy.contains('TIMESTAMP').should('be.visible');
  });

  it('renders Primary Key indicator icon when isPrimary is true', () => {
    cy.log('Step 2.1: Mount TableNode with primary keys');
    mountNode(mockData);

    cy.log('Step 2.2: Verify primary key key icon exists');
    cy.contains('🔑').should('be.visible');
  });

  it('renders target and source connection handles for each column row', () => {
    cy.log('Step 3.1: Mount TableNode to inspect handles');
    mountNode(mockData);

    cy.log('Step 3.2: Verify target and source handles exist for keys');
    cy.get('[data-handleid="target-customer_id"]').should('exist');
    cy.get('[data-handleid="source-customer_id"]').should('exist');
    cy.get('[data-handleid="target-name"]').should('exist');
    cy.get('[data-handleid="source-name"]').should('exist');
  });
});
