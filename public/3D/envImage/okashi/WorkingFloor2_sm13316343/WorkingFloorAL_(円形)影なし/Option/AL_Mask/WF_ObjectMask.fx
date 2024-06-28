////////////////////////////////////////////////////////////////////////////////////////////////
// ���ʂ̃��f���������h��Ԃ��G�t�F�N�g
////////////////////////////////////////////////////////////////////////////////////////////////
// �A�N�Z�ɑg�ݍ��ޏꍇ�͂�����K�X�ύX���Ă��������D
float3 MirrorPos = float3( 0.0, 0.0, 0.0 );    // ���[�J�����W�n�ɂ����鋾�ʏ�̔C�ӂ̍��W(�A�N�Z���_���W�̈�_)
float3 MirrorNormal = float3( 0.0, 1.0, 0.0 ); // ���[�J�����W�n�ɂ����鋾�ʂ̖@���x�N�g��

///////////////////////////////////////////////////////////////////////////////////////////////
// ���ʍ��W�ϊ��p�����[�^
float4x4 MirrorWorldMatrix: CONTROLOBJECT < string Name = "(OffscreenOwner)"; >; // ���ʃA�N�Z�̃��[���h�ϊ��s��

// ���[���h���W�n�ɂ����鋾���ʒu�ւ̕ϊ�
static float3 WldMirrorPos = mul( float4(MirrorPos, 1.0f), MirrorWorldMatrix ).xyz;
static float3 WldMirrorNormal = normalize( mul( MirrorNormal, (float3x3)MirrorWorldMatrix ) );

// ���W�̋����ϊ�
float4 TransMirrorPos( float4 Pos )
{
    Pos.xyz -= WldMirrorNormal * 2.0f * dot(WldMirrorNormal, Pos.xyz - WldMirrorPos);
    return Pos;
}

float3 CameraPosition : POSITION  < string Object = "Camera"; >;

// ���ʕ\������(���W�ƃJ�������������ʂ̕\���ɂ��鎞�����{)
float IsFace( float4 Pos )
{
    return min( dot(Pos.xyz-WldMirrorPos, WldMirrorNormal),
                dot(CameraPosition-WldMirrorPos, WldMirrorNormal) );
}

///////////////////////////////////////////////////////////////////////////////////////////////

// ���W�ϊ��s��
float4x4 ViewProjMatrix : VIEWPROJECTION;
float4x4 WorldMatrix    : WORLD;
float4x4 ViewMatrix     : VIEW;
float4x4 ProjMatrix     : PROJECTION;

float4 MaterialDiffuse : DIFFUSE  < string Object = "Geometry"; >;
static float alpha1 = MaterialDiffuse.a;

bool use_texture;  //�e�N�X�`���̗L��

// �I�u�W�F�N�g�̃e�N�X�`��
texture ObjectTexture: MATERIALTEXTURE;
sampler ObjTexSampler = sampler_state
{
    texture = <ObjectTexture>;
    MINFILTER = LINEAR;
    MAGFILTER = LINEAR;
    MIPFILTER = LINEAR;
    ADDRESSU  = WRAP;
    ADDRESSV  = WRAP;
};


////////////////////////////////////////////////////////////////////////////////////////////////
//MMM�Ή�

#ifndef MIKUMIKUMOVING
    struct VS_INPUT{
        float4 Pos    : POSITION;
        float2 Tex    : TEXCOORD0;
    };
    #define GETPOS (IN.Pos)
    #define GET_VPMAT(p) (ViewProjMatrix)
#else
    #define VS_INPUT  MMM_SKINNING_INPUT
    #define GETPOS MMM_SkinnedPosition(IN.Pos, IN.BlendWeight, IN.BlendIndices, IN.SdefC, IN.SdefR0, IN.SdefR1)
    #define GET_VPMAT(p) (MMM_IsDinamicProjection ? mul(ViewMatrix, MMM_DynamicFov(ProjMatrix, length(CameraPosition-p.xyz))) : ViewProjMatrix)
#endif

////////////////////////////////////////////////////////////////////////////////////////////////

struct VS_OUTPUT
{
    float4 Pos   : POSITION;    // �ˉe�ϊ����W
    float2 Tex   : TEXCOORD1;   // �e�N�X�`��
    float4 WPos  : TEXCOORD2;   // ���������[���h���W
};

// ���_�V�F�[�_
VS_OUTPUT Basic_VS(VS_INPUT IN)
{
    VS_OUTPUT Out = (VS_OUTPUT)0;

    // ���[���h���W�ϊ�
    float4 Pos = mul( GETPOS, WorldMatrix );
    Out.WPos = Pos; // ���[���h���W

    // �����ʒu�ւ̍��W�ϊ�
    Pos = TransMirrorPos( Pos ); // �����ϊ�

    // �J�������_�̃r���[�ˉe�ϊ�
    Out.Pos = mul( Pos, GET_VPMAT(Pos) );
    Out.Pos.x = -Out.Pos.x; // �|���S�������Ԃ�Ȃ��悤�ɍ��E���]�ɂ��ĕ`��

    // �e�N�X�`�����W
    Out.Tex = IN.Tex;

    return Out;
}

float4 Basic_PS( VS_OUTPUT IN ) : COLOR0
{
    // ���ʂ̗����ɂ��镔�ʂ͋����\�����Ȃ�
    clip( IsFace( IN.WPos ) );

    float alpha = alpha1;
    if ( use_texture ) alpha *= tex2D( ObjTexSampler, IN.Tex ).a;

    return float4(0.0, 0.0, 0.0, alpha);
}

//�Z���t�V���h�E�Ȃ�
technique Mask < string MMDPass = "object"; > {
    pass Single_Pass { 
        VertexShader = compile vs_2_0 Basic_VS();
        PixelShader = compile ps_2_0 Basic_PS(); 
    }
}

//�Z���t�V���h�E����
technique MaskSS < string MMDPass = "object_ss"; > {
    pass Single_Pass { 
        VertexShader = compile vs_2_0 Basic_VS();
        PixelShader = compile ps_2_0 Basic_PS(); 
    }
}

//�e��֊s�͕`�悵�Ȃ�
technique EdgeTec < string MMDPass = "edge"; > { }
technique ShadowTec < string MMDPass = "shadow"; > { }
technique ZplotTec < string MMDPass = "zplot"; > { }

