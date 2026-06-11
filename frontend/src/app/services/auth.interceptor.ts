import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  
  // VERIFICACIÓN ESTRICTA: Evitar enviar "Bearer null" o "Bearer undefined"
  if (token && token !== 'null' && token !== 'undefined' && token.length > 10) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }

  return next(req);
};
