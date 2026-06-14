import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentModal from '../StudentModal';
import * as apiClient from '../../api/client';

// Mock du module api/client
vi.mock('../../api/client');

const mockClasses = [
  { id: 1, label: 'Class A', year: '2024', createdAt: '2024-01-01' },
  { id: 2, label: 'Class B', year: '2024', createdAt: '2024-01-01' },
];

const mockStudent = {
  id: 1,
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  photoUrl: null,
  classId: 1,
  createdAt: '2024-01-01',
};

describe('StudentModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Mode création (création)', () => {
    it('affiche le titre "Nouvel élève"', () => {
      render(
        <StudentModal
          editing={null}
          classes={mockClasses}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      );

      expect(screen.getByText('Nouvel élève')).toBeInTheDocument();
    });

    it('affiche les champs vides', () => {
      render(
        <StudentModal
          editing={null}
          classes={mockClasses}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      );

      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
      expect(inputs.length).toBeGreaterThan(0);
      inputs.forEach((input) => {
        expect(input).toHaveValue('');
      });
    });

    it('désactive le submit si classId est vide', async () => {
      const user = userEvent.setup();
      const createStudentMock = vi.fn();
      vi.mocked(apiClient.createStudent).mockImplementation(createStudentMock);

      render(
        <StudentModal
          editing={null}
          classes={mockClasses}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      );

      // Remplir tous les champs sauf la classe
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
      await user.type(inputs[0], 'John');
      await user.type(inputs[1], 'Doe');
      await user.type(inputs[2], 'john@example.com');

      // Soumettre sans sélectionner une classe
      const buttons = screen.getAllByRole('button');
      const submitBtn = buttons[buttons.length - 1]; // Dernier bouton = Enregistrer
      await user.click(submitBtn);

      // createStudent ne doit pas être appelé
      expect(createStudentMock).not.toHaveBeenCalled();
    });

    it('appelle createStudent quand tous les champs sont remplis', async () => {
      const user = userEvent.setup();
      const createStudentMock = vi.fn().mockResolvedValue(mockStudent);
      vi.mocked(apiClient.createStudent).mockImplementation(createStudentMock);

      render(
        <StudentModal
          editing={null}
          classes={mockClasses}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      );

      // Remplir les champs
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
      await user.type(inputs[0], 'John');
      await user.type(inputs[1], 'Doe');
      await user.type(inputs[2], 'john@example.com');

      // Sélectionner une classe
      const buttons = screen.getAllByRole('button');
      const selectBtn = buttons.find((btn) => btn.textContent?.includes('Sélectionner une classe'));
      if (selectBtn) {
        await user.click(selectBtn);
        // Le Select affiche "Class A — 2024", pas juste "Class A"
        await user.click(screen.getByText(/Class A/));
      }

      // Soumettre
      const submitBtn = buttons[buttons.length - 1]; // Dernier bouton = Enregistrer
      await user.click(submitBtn);

      await waitFor(() => {
        expect(createStudentMock).toHaveBeenCalled();
      });
    });
  });

  describe('Mode édition', () => {
    it('affiche le titre "Modifier l\'élève"', () => {
      render(
        <StudentModal
          editing={mockStudent}
          classes={mockClasses}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      );

      expect(screen.getByText("Modifier l'élève")).toBeInTheDocument();
    });

    it('pré-remplit les champs avec les données de l\'élève', () => {
      render(
        <StudentModal
          editing={mockStudent}
          classes={mockClasses}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      );

      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
      expect(inputs[0]).toHaveValue(mockStudent.firstName);
      expect(inputs[1]).toHaveValue(mockStudent.lastName);
      expect(inputs[2]).toHaveValue(mockStudent.email);
    });

    it('appelle updateStudent quand on soumet', async () => {
      const user = userEvent.setup();
      const updateStudentMock = vi.fn().mockResolvedValue(mockStudent);
      vi.mocked(apiClient.updateStudent).mockImplementation(updateStudentMock);

      render(
        <StudentModal
          editing={mockStudent}
          classes={mockClasses}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      );

      const buttons = screen.getAllByRole('button');
      const submitBtn = buttons[buttons.length - 1]; // Dernier bouton = Enregistrer
      await user.click(submitBtn);

      await waitFor(() => {
        expect(updateStudentMock).toHaveBeenCalledWith(mockStudent.id, expect.any(Object));
      });
    });
  });

  describe('Photo upload', () => {
    it('ouvre le CropModal après sélection d\'une photo', async () => {
      const user = userEvent.setup();
      render(
        <StudentModal
          editing={null}
          classes={mockClasses}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      );

      // Le fichier input est caché, on le cherche directement
      const fileInputs = document.querySelectorAll('input[type="file"]');
      const photoInput = Array.from(fileInputs).find(
        (input) => (input as HTMLInputElement).accept === 'image/jpeg,image/png'
      ) as HTMLInputElement;

      expect(photoInput).toBeInTheDocument();

      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(photoInput, file);

      await waitFor(() => {
        expect(screen.getByText('Recadrer la photo')).toBeInTheDocument();
      });
    });
  });

  describe('Gestion des erreurs', () => {
    it('affiche un message d\'erreur en cas d\'échec', async () => {
      const user = userEvent.setup();
      const errorMsg = 'Email déjà utilisé';
      const createStudentMock = vi.fn().mockRejectedValue({
        response: { data: { message: errorMsg } },
      });
      vi.mocked(apiClient.createStudent).mockImplementation(createStudentMock);

      render(
        <StudentModal
          editing={null}
          classes={mockClasses}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      );

      // Remplir et soumettre
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
      await user.type(inputs[0], 'John');
      await user.type(inputs[1], 'Doe');
      await user.type(inputs[2], 'john@example.com');

      const buttons = screen.getAllByRole('button');
      const selectBtn = buttons.find((btn) => btn.textContent?.includes('Sélectionner une classe'));
      if (selectBtn) {
        await user.click(selectBtn);
        // Chercher avec un regex pour matcher "Class A — 2024"
        await user.click(screen.getByText(/Class A/));
      }

      const submitBtn = buttons[buttons.length - 1]; // Dernier bouton = Enregistrer
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(errorMsg)).toBeInTheDocument();
      });
    });
  });
});
