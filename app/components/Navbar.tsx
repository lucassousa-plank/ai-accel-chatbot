'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import Button from '@mui/material/Button';
import { ThemeProvider, createTheme } from '@mui/material/styles';

export default function Navbar() {
  const router = useRouter();
  const supabase = createClient();

  // Create a custom MUI theme to match our vampire aesthetic
  const muiTheme = createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#9333ea', // purple-600
      },
    },
    typography: {
      fontFamily: 'var(--font-cinzel)',
      button: {
        textTransform: 'none',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderWidth: '2px',
            '&:hover': {
              borderWidth: '2px',
            },
          },
        },
      },
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-full mx-4 px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center">
          {/* Empty div for spacing */}
          <div className="w-24"></div>
          {/* Centered title */}
          <div className="flex-1 flex justify-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 via-purple-400 to-red-600 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-cinzel)' }}>
            Interview with the Vampire
          </h1>
          </div>
          {/* Theme toggle and sign out button */}
          <div className="w-24 flex justify-end items-center space-x-2">
            <ThemeProvider theme={muiTheme}>
              <Button 
                variant="outlined"
                onClick={handleSignOut}
                size="medium"
                sx={{
                  px: 3,
                  py: 0.5,
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  minWidth: 'auto',
                  height: '32px',
                  borderColor: 'rgba(147, 51, 234, 0.5)',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'rgba(147, 51, 234, 0.8)',
                    backgroundColor: 'rgba(147, 51, 234, 0.1)',
                  },
                }}
              >
                Sign Out
              </Button>
            </ThemeProvider>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
} 