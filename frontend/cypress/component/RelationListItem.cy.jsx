import RelationListItem from '../../src/components/RelationListItem';

describe('<RelationListItem /> Component', () => {
  const mockEdge = {
    id: 'edge-1',
    source: 'tbl-1',
    target: 'tbl-2',
    data: {
      name: 'users_profiles_rel',
      cardinality: 'One to One',
      compositeKeys: [],
    },
  };

  const mockTables = [
    { id: 'tbl-1', name: 'Users', columns: [{ name: 'id' }] },
    { id: 'tbl-2', name: 'Profiles', columns: [{ name: 'user_id' }] },
  ];

  it('renders collapsed header and toggles accordion to show properties', () => {
    cy.log('Step 1.1: Mount RelationListItem component');
    cy.mount(
      <RelationListItem
        edge={mockEdge}
        tables={mockTables}
        onUpdate={cy.stub()}
        onDelete={cy.stub()}
      />
    );

    cy.contains('users_profiles_rel').should('be.visible');

    cy.log('Step 1.2: Expand relationship accordion');
    cy.contains('users_profiles_rel').click();

    cy.log('Step 1.3: Verify inputs are populated with values');
    cy.get('input[value="users_profiles_rel"]').should('be.visible');
    cy.get('input[value="Users"]').should('be.visible');
    cy.get('input[value="Profiles"]').should('be.visible');
  });

  it('triggers onUpdate when editing relationship name or cardinality', () => {
    cy.log('Step 2.1: Mount RelationListItem with stub update callback');
    const onUpdateSpy = cy.spy().as('onUpdateSpy');
    cy.mount(
      <RelationListItem
        edge={mockEdge}
        tables={mockTables}
        onUpdate={onUpdateSpy}
        onDelete={cy.stub()}
      />
    );

    cy.contains('users_profiles_rel').click();

    cy.log('Step 2.2: Edit relationship name');
    cy.get('input[value="users_profiles_rel"]').type('{selectall}{backspace}user_link');
    cy.get('@onUpdateSpy').should('have.been.called');

    cy.log('Step 2.3: Change cardinality select input');
    cy.get('select').first().select('One to Many');
    cy.get('@onUpdateSpy').should('have.been.called');
  });

  it('triggers onDelete when clicking delete relationship button', () => {
    cy.log('Step 3.1: Mount RelationListItem with stub delete callback');
    const onDeleteSpy = cy.spy().as('onDeleteSpy');
    cy.mount(
      <RelationListItem
        edge={mockEdge}
        tables={mockTables}
        onUpdate={cy.stub()}
        onDelete={onDeleteSpy}
      />
    );

    cy.contains('users_profiles_rel').click();

    cy.log('Step 3.2: Click delete relationship button');
    cy.get('button[title="Delete relationship"]').click();

    cy.log('Step 3.3: Verify onDelete callback triggered');
    cy.get('@onDeleteSpy').should('have.been.calledOnce');
  });
});
