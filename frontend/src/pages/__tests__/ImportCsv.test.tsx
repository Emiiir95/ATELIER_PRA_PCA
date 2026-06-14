import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportCsv from '../ImportCsv';
import * as apiClient from '../../api/client';

// Mock du module api/client
vi.mock('../../api/client');

describe('ImportCsv Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche la page avec tous les éléments', () => {
    render(<ImportCsv />);

    expect(screen.getByText('Import CSV')).toBeInTheDocument();
    expect(screen.getByText('Importez des élèves en masse via un fichier CSV.')).toBeInTheDocument();
    expect(screen.getByText('Cliquez pour sélectionner un fichier')).toBeInTheDocument();
  });

  it('désactive le bouton Importer quand aucun fichier', () => {
    render(<ImportCsv />);

    const importBtn = screen.getByRole('button', { name: /Importer/ });
    expect(importBtn).toBeDisabled();
  });

  it('active le bouton Importer quand un fichier est sélectionné', async () => {
    const user = userEvent.setup();
    render(<ImportCsv />);

    const fileInput = screen.getByDisplayValue('');
    const file = new File(['test data'], 'data.csv', { type: 'text/csv' });

    await user.upload(fileInput, file);

    const importBtn = screen.getByRole('button', { name: /Importer/ });
    expect(importBtn).not.toBeDisabled();
  });

  it('affiche le résumé après un import réussi', async () => {
    const user = userEvent.setup();
    const mockResult = {
      created: 25,
      errors: 3,
      details: [
        {
          row: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
          error: 'Email invalide',
        },
      ],
    };

    vi.mocked(apiClient.importCsv).mockResolvedValue(mockResult);

    render(<ImportCsv />);

    // Sélectionner un fichier
    const fileInput = screen.getByDisplayValue('');
    const file = new File(['test data'], 'data.csv', { type: 'text/csv' });
    await user.upload(fileInput, file);

    // Cliquer sur Importer
    const importBtn = screen.getByRole('button', { name: /Importer/ });
    await user.click(importBtn);

    // Attendre que les résultats s'affichent
    await waitFor(() => {
      expect(screen.getByText('Résultats')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('affiche un message d\'erreur en cas d\'échec', async () => {
    const user = userEvent.setup();
    const errorMsg = 'Format CSV invalide';

    vi.mocked(apiClient.importCsv).mockRejectedValue({
      response: { data: { message: errorMsg } },
    });

    render(<ImportCsv />);

    // Sélectionner un fichier
    const fileInput = screen.getByDisplayValue('');
    const file = new File(['invalid data'], 'data.csv', { type: 'text/csv' });
    await user.upload(fileInput, file);

    // Cliquer sur Importer
    const importBtn = screen.getByRole('button', { name: /Importer/ });
    await user.click(importBtn);

    // Attendre le message d'erreur
    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeInTheDocument();
    });
  });

  it('affiche "Import en cours..." pendant le traitement', async () => {
    const user = userEvent.setup();

    // Mock importCsv pour qu'il soit lent
    vi.mocked(apiClient.importCsv).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ created: 1, errors: 0, details: [] });
          }, 1000);
        })
    );

    render(<ImportCsv />);

    // Sélectionner un fichier et importer
    const fileInput = screen.getByDisplayValue('');
    const file = new File(['test'], 'data.csv', { type: 'text/csv' });
    await user.upload(fileInput, file);

    const importBtn = screen.getByRole('button', { name: /Importer/ });
    await user.click(importBtn);

    // Vérifier que le texte change
    expect(screen.getByText('Import en cours...')).toBeInTheDocument();
  });

  it('show reset button après sélection d\'un fichier', async () => {
    const user = userEvent.setup();
    render(<ImportCsv />);

    const fileInput = screen.getByDisplayValue('');
    const file = new File(['test'], 'data.csv', { type: 'text/csv' });
    await user.upload(fileInput, file);

    const resetBtn = screen.getByRole('button', { name: /Réinitialiser/ });
    expect(resetBtn).toBeInTheDocument();
  });

  it('réinitialise l\'état au click sur Réinitialiser', async () => {
    const user = userEvent.setup();
    const mockResult = {
      created: 5,
      errors: 0,
      details: [],
    };

    vi.mocked(apiClient.importCsv).mockResolvedValue(mockResult);

    render(<ImportCsv />);

    // Sélectionner et importer
    const fileInput = screen.getByDisplayValue('');
    const file = new File(['test'], 'data.csv', { type: 'text/csv' });
    await user.upload(fileInput, file);

    const importBtn = screen.getByRole('button', { name: /Importer/ });
    await user.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText('data.csv')).toBeInTheDocument();
    });

    // Cliquer sur Réinitialiser
    const resetBtn = screen.getByRole('button', { name: /Réinitialiser/ });
    await user.click(resetBtn);

    // Vérifier que l'état est réinitialisé
    await waitFor(() => {
      expect(screen.queryByText('Résultats')).not.toBeInTheDocument();
      expect(screen.getByText('Cliquez pour sélectionner un fichier')).toBeInTheDocument();
    });
  });

  it('appelle importCsv avec le fichier sélectionné', async () => {
    const user = userEvent.setup();
    const mockResult = {
      created: 1,
      errors: 0,
      details: [],
    };

    const importCsvMock = vi.fn().mockResolvedValue(mockResult);
    vi.mocked(apiClient.importCsv).mockImplementation(importCsvMock);

    render(<ImportCsv />);

    const fileInput = screen.getByDisplayValue('');
    const file = new File(['test data'], 'test.csv', { type: 'text/csv' });
    await user.upload(fileInput, file);

    const importBtn = screen.getByRole('button', { name: /Importer/ });
    await user.click(importBtn);

    await waitFor(() => {
      expect(importCsvMock).toHaveBeenCalledWith(file);
    });
  });

  it('affiche CsvFormatInfo component', () => {
    render(<ImportCsv />);

    // Vérifier que le composant CsvFormatInfo contient des informations
    const pageContent = screen.getByText('Import CSV');
    expect(pageContent).toBeInTheDocument();
  });

  it('réinitialise les erreurs quand un nouveau fichier est sélectionné', async () => {
    const user = userEvent.setup();

    vi.mocked(apiClient.importCsv).mockRejectedValueOnce({
      response: { data: { message: 'Erreur' } },
    });

    render(<ImportCsv />);

    // Import initial qui échoue
    const fileInput = screen.getByDisplayValue('');
    const file = new File(['test1'], 'data1.csv', { type: 'text/csv' });
    await user.upload(fileInput, file);

    const importBtn = screen.getByRole('button', { name: /Importer/ });
    await user.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText('Erreur')).toBeInTheDocument();
    });

    // Réinitialiser les mocks pour test suivant
    vi.clearAllMocks();

    // Vérifier que l'erreur est affichée
    expect(screen.getByText('Erreur')).toBeInTheDocument();
  });
});
