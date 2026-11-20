const AUTH_MESSAGES = {
  'auth/invalid-email': 'Confira se o e-mail foi digitado corretamente.',
  'auth/invalid-credential': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  'auth/user-not-found': 'Não encontramos uma conta com este e-mail.',
  'auth/wrong-password': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  'auth/user-disabled': 'Esta conta está desativada. Entre em contato com o suporte.',
  'auth/too-many-requests': 'Muitas tentativas de acesso. Aguarde um pouco e tente novamente.',
  'auth/network-request-failed': 'Não foi possível conectar. Verifique sua internet e tente novamente.',
};

export function getAuthErrorMessage(error) {
  return AUTH_MESSAGES[error?.code] || 'Não foi possível entrar. Verifique seus dados e tente novamente.';
}
