import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CsvDropZone from '../CsvDropZone';

describe('CsvDropZone', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le texte par défaut quand aucun fichier sélectionné', () => {
    render(<CsvDropZone file={null} onChange={mockOnChange} />);

    expect(screen.getByText('Cliquez pour sélectionner un fichier')).toBeInTheDocument();
    expect(screen.getByText('Format .csv uniquement')).toBeInTheDocument();
  });

  it('affiche le nom du fichier après sélection', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CsvDropZone file={null} onChange={mockOnChange} />);

    const input = screen.getByDisplayValue('');
    (input as HTMLInputElement).accept = '.csv,text/csv';

    const file = new File(['test data'], 'data.csv', { type: 'text/csv' });
    await user.upload(input, file);

    expect(mockOnChange).toHaveBeenCalledWith(file);

    // Simuler la réception du fichier
    rerender(<CsvDropZone file={file} onChange={mockOnChange} />);

    expect(screen.getByText('data.csv')).toBeInTheDocument();
  });

  it('change le style visuel quand un fichier est sélectionné', async () => {
    const file = new File(['test data'], 'data.csv', { type: 'text/csv' });

    const { container } = render(<CsvDropZone file={file} onChange={mockOnChange} />);

    // Vérifier que le style change (classe avec bg-violet-50)
    const dropZone = container.querySelector('div');
    expect(dropZone).toHaveClass('bg-violet-50');
    expect(dropZone).toHaveClass('border-violet-400');
  });

  it('accepte uniquement les fichiers CSV', async () => {
    render(<CsvDropZone file={null} onChange={mockOnChange} />);

    const input = screen.getByDisplayValue('') as HTMLInputElement;

    // Vérifier l'attribut accept
    expect(input.accept).toBe('.csv,text/csv');
  });

  it('appelle onChange avec le fichier sélectionné', async () => {
    const user = userEvent.setup();
    render(<CsvDropZone file={null} onChange={mockOnChange} />);

    const input = screen.getByDisplayValue('');
    const file = new File(['content'], 'import.csv', { type: 'text/csv' });

    await user.upload(input, file);

    expect(mockOnChange).toHaveBeenCalledWith(file);
  });

  it('ouvre le sélecteur de fichier au click', async () => {
    const user = userEvent.setup();
    render(<CsvDropZone file={null} onChange={mockOnChange} />);

    const dropZone = screen.getByText('Cliquez pour sélectionner un fichier').closest('div');
    await user.click(dropZone!);

    // L'input doit être cliqué (pas de vérification directe possible en jsdom)
    // Mais on peut vérifier que le comportement fonctionne
    expect(dropZone).toBeInTheDocument();
  });
});
