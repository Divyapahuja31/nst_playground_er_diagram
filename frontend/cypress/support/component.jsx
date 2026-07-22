import { mount } from 'cypress/react';
import '../../src/index.css';
import '@xyflow/react/dist/style.css';

Cypress.Commands.add('mount', mount);
