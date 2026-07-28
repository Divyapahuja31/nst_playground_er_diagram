import TableListItem from '../../src/components/TableListItem';

describe('<TableListItem /> Component', () => {
  const mockTable = {
    id: 'table-1',
    name: 'ACCOUNT',
    columns: [
      { name: 'account_id', type: 'INTEGER', isPrimary: true },
      { name: 'balance', type: 'FLOAT', isPrimary: false },
    ],
  };

  it('renders collapsed table header and toggles accordion on click', () => {
    cy.log('Step 1.1: Mount TableListItem component');
    cy.mount(<TableListItem table={mockTable} onUpdate={cy.stub()} onDelete={cy.stub()} />);

    cy.log('Step 1.2: Check collapsed visibility rules');
    cy.contains('ACCOUNT').should('be.visible');
    cy.contains('Add field').should('not.exist');

    cy.log('Step 1.3: Click header to expand accordion');
    cy.contains('ACCOUNT').click();

    cy.log('Step 1.4: Check expanded items are visible');
    cy.contains('Add field').should('be.visible');
    cy.get('button[title="Delete table"]').should('be.visible');
  });

  it('triggers onUpdate when editing table name', () => {
    cy.log('Step 2.1: Mount TableListItem with stub update callback');
    const onUpdateSpy = cy.spy().as('onUpdateSpy');
    cy.mount(<TableListItem table={mockTable} onUpdate={onUpdateSpy} onDelete={cy.stub()} />);

    cy.log('Step 2.2: Expand and rename table input');
    cy.contains('ACCOUNT').click();
    cy.get('input[value="ACCOUNT"]').clear().type('ACCOUNTS');

    cy.log('Step 2.3: Verify onUpdate callback triggered');
    cy.get('@onUpdateSpy').should('have.been.called');
  });

  it('triggers onDelete when clicking delete table button', () => {
    cy.log('Step 3.1: Mount TableListItem with stub delete callback');
    const onDeleteSpy = cy.spy().as('onDeleteSpy');
    cy.mount(<TableListItem table={mockTable} onUpdate={cy.stub()} onDelete={onDeleteSpy} />);

    cy.log('Step 3.2: Expand and click delete table button');
    cy.contains('ACCOUNT').click();
    cy.get('button[title="Delete table"]').click();

    cy.log('Step 3.3: Verify onDelete callback triggered');
    cy.get('@onDeleteSpy').should('have.been.calledOnce');
  });
});
