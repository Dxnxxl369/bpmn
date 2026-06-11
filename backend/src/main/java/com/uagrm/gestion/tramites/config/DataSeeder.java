package com.uagrm.gestion.tramites.config;

import com.uagrm.gestion.tramites.model.Usuario;
import com.uagrm.gestion.tramites.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.ArrayList;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        System.out.println(">>> INICIANDO VERIFICACIÓN DE USUARIOS (SEED DATA)...");

        // 1. ADMIN PRINCIPAL
        asegurarUsuario("admin", "ADMIN", "SISTEMA", "admin", "ADMINISTRADOR");

        // 2. ADMIN COLABORADOR
        asegurarUsuario("test", "TEST", "USER", "test", "ADMINISTRADOR");

        // 3. FUNCIONARIOS
        asegurarUsuario("atencion", "PEDRO", "ATENCION", "atencion", "FUNCIONARIO");
        asegurarUsuario("central", "JUAN", "CONTADOR", "central", "FUNCIONARIO");
        asegurarUsuario("caja", "ANA", "CAJA", "caja", "FUNCIONARIO");

        System.out.println(">>> SEED DATA FINALIZADO EXITOSAMENTE.");
    }

    private void asegurarUsuario(String email, String nombre, String apellido, String username, String rol) {
        usuarioRepository.findByEmail(email).ifPresentOrElse(
            u -> System.out.println("  [-] Usuario ya existe: " + email),
            () -> {
                Usuario u = new Usuario();
                u.setNombre(nombre);
                u.setApellido(apellido);
                u.setUsername(username);
                u.setEmail(email);
                u.setPasswordHash(passwordEncoder.encode("admin123"));
                u.setRol(rol);
                u.setAvatar("https://api.dicebear.com/7.x/avataaars/svg?seed=" + email);
                u.setPermisos(Set.of("VIEW_PALETTE", "MANAGE_DIAGRAM", "ADMIN_SECURITY"));
                u.setDepartamentoIds(new ArrayList<>());
                usuarioRepository.save(u);
                System.out.println("  [+] USUARIO CREADO: " + email);
            }
        );
    }
}
