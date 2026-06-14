import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImportResults from '../ImportResults';
import type { ImportResult } from '../../types';

describe('ImportResults', () => {
  it('affiche le nombre d\'élèves créés', () => {
    const result: ImportResult = {
      created: 25,
      errors: 0,
      details: [],
    };

    render(<ImportResults result={result} />);

    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText("Élève(s) créé(s) / mis à jour")).toBeInTheDocument();
  });

  it('affiche le nombre d\'erreurs', () => {
    const result: ImportResult = {
      created: 25,
      errors: 3,
      details: [],
    };

    render(<ImportResults result={result} />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Erreur(s)')).toBeInTheDocument();
  });

  it('affiche le titre "Résultats"', () => {
    const result: ImportResult = {
      created: 10,
      errors: 0,
      details: [],
    };

    render(<ImportResults result={result} />);

    expect(screen.getByText('Résultats')).toBeInTheDocument();
  });

  it('affiche la section détails si des erreurs existent', () => {
    const result: ImportResult = {
      created: 25,
      errors: 2,
      details: [
        {
          row: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
          error: 'Email invalide',
        },
        {
          row: { first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' },
          error: 'Classe introuvable',
        },
      ],
    };

    render(<ImportResults result={result} />);

    expect(screen.getByText('Détails ligne par ligne')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Email invalide')).toBeInTheDocument();
    expect(screen.getByText('Classe introuvable')).toBeInTheDocument();
  });

  it('affiche le badge ERR pour chaque erreur', () => {
    const result: ImportResult = {
      created: 1,
      errors: 1,
      details: [
        {
          row: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
          error: 'Email invalide',
        },
      ],
    };

    render(<ImportResults result={result} />);

    // Vérifier que le badge ERR existe
    const errBadges = screen.getAllByText('ERR');
    expect(errBadges.length).toBeGreaterThan(0);
  });

  it('affiche le badge OK pour les lignes sans erreur', () => {
    const result: ImportResult = {
      created: 1,
      errors: 0,
      details: [
        {
          row: { first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' },
          status: 'OK',
        },
      ],
    };

    render(<ImportResults result={result} />);

    // Vérifier que le badge OK existe
    const okBadges = screen.getAllByText('OK');
    expect(okBadges.length).toBeGreaterThan(0);
  });

  it('affiche les emails des élèves', () => {
    const result: ImportResult = {
      created: 2,
      errors: 0,
      details: [
        {
          row: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
        },
        {
          row: { first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' },
        },
      ],
    };

    render(<ImportResults result={result} />);

    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('masque la section détails si aucune ligne', () => {
    const result: ImportResult = {
      created: 5,
      errors: 0,
      details: [],
    };

    const { container } = render(<ImportResults result={result} />);

    const hasDetailsSection = Array.from(container.querySelectorAll('p')).some(
      (p) => p.textContent?.includes('Détails ligne par ligne')
    );

    expect(hasDetailsSection).toBe(false);
  });

  it('affiche le nombre zéro correctement', () => {
    const result: ImportResult = {
      created: 0,
      errors: 5,
      details: [],
    };

    render(<ImportResults result={result} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('gère un résumé avec beaucoup de détails', () => {
    const details = Array.from({ length: 50 }, (_, i) => ({
      row: {
        first_name: `User${i}`,
        last_name: `Name${i}`,
        email: `user${i}@example.com`,
      },
      error: i % 3 === 0 ? 'Erreur test' : undefined,
    }));

    const result: ImportResult = {
      created: 40,
      errors: 10,
      details,
    };

    render(<ImportResults result={result} />);

    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('User0 Name0')).toBeInTheDocument();
  });
});
